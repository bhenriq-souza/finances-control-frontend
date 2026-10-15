import type { Page } from '@playwright/test';

import type { RecordedRequest } from '../api';
import type { components } from '../../../src/api/generated/schema';
import {
    BANK_ACCOUNTS,
    CONTA_CORRENTE,
    CREDIT_CARDS,
    ITAU_VISA,
    NUBANK_ROXINHO,
    POUPANCA,
} from './accounts';
import { OCTOBER_EARNINGS } from './earnings';

type Schemas = components['schemas'];
type Expense = Schemas['ExpenseResponse'];
type Statement = Schemas['StatementResponse'];

// Dados do e2e do dashboard (spec 0015, AC-0015-01): "hoje" é 15/10/2026 e a semana vai até
// 21/10. Contas e cartões de `accounts.ts` (com um arquivado de cada), receitas de `earnings.ts`.

export const DASHBOARD_TODAY = '2026-10-15T12:00:00-03:00';

const CREATED = '2026-10-01T12:00:00Z';
const MORADIA = { id: '31000000-0000-4000-8000-000000000001', name: 'Moradia' };
const SAUDE = { id: '31000000-0000-4000-8000-000000000002', name: 'Saúde' };
const MERCADO = { id: '31000000-0000-4000-8000-000000000003', name: 'Mercado' };
const EDUCACAO = { id: '31000000-0000-4000-8000-000000000004', name: 'Educação' };
const LAZER = { id: '31000000-0000-4000-8000-000000000005', name: 'Lazer' };

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

export const ALUGUEL = expense({
    id: '61000000-0000-4000-8000-000000000001',
    description: 'Aluguel',
    status: 'PAID',
    amountCents: 180000,
    occurredOn: '2026-10-05',
    paidOn: '2026-10-05',
});
export const FARMACIA = expense({
    id: '61000000-0000-4000-8000-000000000002',
    description: 'Farmácia',
    status: 'OVERDUE',
    amountCents: 4570,
    occurredOn: '2026-10-08',
});
export const INTERNET = expense({
    id: '61000000-0000-4000-8000-000000000003',
    description: 'Internet',
    status: 'OPEN',
    amountCents: 9990,
    occurredOn: '2026-10-15',
    bankAccountId: POUPANCA.id,
});
export const CONDOMINIO = expense({
    id: '61000000-0000-4000-8000-000000000004',
    description: 'Condomínio',
    status: 'VERIFYING',
    amountCents: 65000,
    occurredOn: '2026-10-18',
});
/** Despesa de cartão: entra no total do mês, nunca em "Vence esta semana". */
export const MERCADO_CARTAO = expense({
    id: '61000000-0000-4000-8000-000000000005',
    description: 'Mercado no cartão',
    status: 'OPEN',
    amountCents: 23490,
    occurredOn: '2026-10-16',
    bankAccountId: null,
    creditCardId: NUBANK_ROXINHO.id,
    postedOn: '2026-10-16',
});
/** Prevista: entra no total do mês, não vence. */
export const LUZ = expense({
    id: '61000000-0000-4000-8000-000000000006',
    description: 'Conta de luz',
    status: 'FORECAST',
    amountCents: 15000,
    occurredOn: '2026-10-20',
});
/** Depois de 21/10: fora da semana. */
export const ESCOLA = expense({
    id: '61000000-0000-4000-8000-000000000007',
    description: 'Escola',
    status: 'OPEN',
    amountCents: 120000,
    occurredOn: '2026-10-25',
});
/** Vencida de setembro: só vem pela consulta de vencidas. */
export const IPVA = expense({
    id: '61000000-0000-4000-8000-000000000008',
    description: 'IPVA',
    status: 'OVERDUE',
    amountCents: 98000,
    occurredOn: '2026-09-28',
});

/** Todas as despesas que o stub conhece; `GET /expenses` filtra por `status`, `from` e `to`. */
export const DASHBOARD_EXPENSES = [
    ESCOLA,
    ALUGUEL,
    MERCADO_CARTAO,
    FARMACIA,
    IPVA,
    INTERNET,
    CONDOMINIO,
    LUZ,
];

function statement(
    fields: Pick<Statement, 'id' | 'creditCardId' | 'status' | 'closesOn' | 'dueOn'> &
        Partial<Statement>,
): Statement {
    return {
        startsOn: '2026-09-01',
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

/** Fechada, a pagar, vence hoje: **Vence hoje** na semana e **Fechada** no cartão. */
export const ROXINHO_CLOSED = statement({
    id: '41000000-0000-4000-8000-000000000001',
    creditCardId: NUBANK_ROXINHO.id,
    status: 'CLOSED',
    closesOn: '2026-10-08',
    dueOn: '2026-10-15',
    totalCents: 35000,
    amountDueCents: 35000,
    remainingCents: 35000,
    closedAt: '2026-10-09T03:00:00Z',
});

/** Fechada, vencida e com saldo: **Vencida** na semana e no cartão. */
export const VISA_CLOSED = statement({
    id: '41000000-0000-4000-8000-000000000002',
    creditCardId: ITAU_VISA.id,
    status: 'CLOSED',
    closesOn: '2026-09-25',
    dueOn: '2026-10-05',
    totalCents: 102550,
    amountDueCents: 102550,
    paidCents: 100000,
    remainingCents: 2550,
    overdue: true,
    closedAt: '2026-09-26T03:00:00Z',
});

/** `GET /statements?creditCardId` sem janela, por cartão. */
export const DASHBOARD_STATEMENTS: Record<string, Statement[]> = {
    [NUBANK_ROXINHO.id]: [
        statement({
            id: '41000000-0000-4000-8000-000000000003',
            creditCardId: NUBANK_ROXINHO.id,
            status: 'PAID',
            closesOn: '2026-09-08',
            dueOn: '2026-09-15',
        }),
        ROXINHO_CLOSED,
        statement({
            id: null,
            creditCardId: NUBANK_ROXINHO.id,
            status: 'OPEN',
            closesOn: '2026-11-08',
            dueOn: '2026-11-15',
        }),
    ],
    [ITAU_VISA.id]: [
        VISA_CLOSED,
        statement({
            id: null,
            creditCardId: ITAU_VISA.id,
            status: 'OPEN',
            closesOn: '2026-10-25',
            dueOn: '2026-11-05',
        }),
    ],
};

/** `GET /reports/balance?from=2026-10&to=2026-10`: o previsto de outubro. */
export const BALANCE_OCTOBER: Schemas['BalanceReport'] = {
    from: '2026-10',
    to: '2026-10',
    points: [
        {
            month: '2026-10',
            kind: 'FORECAST',
            accounts: [
                { bankAccountId: CONTA_CORRENTE.id, balanceCents: 112345 },
                { bankAccountId: POUPANCA.id, balanceCents: 500000 },
            ],
            accountsTotalCents: 612345,
            cardDebtCents: 37550,
            unassignedCardDebtCents: 2550,
            cardDueCents: 37550,
            consolidatedCents: 574795,
        },
    ],
};

/** `GET /reports/expenses-by-type?from=2026-10&to=2026-10`, por total decrescente. */
export const EXPENSES_BY_TYPE_OCTOBER: Schemas['ByTypeReport'] = {
    from: '2026-10',
    to: '2026-10',
    includeForecast: false,
    months: [
        {
            month: '2026-10',
            totalCents: 403060,
            refundsCents: 0,
            byType: [
                { typeId: MORADIA.id, name: MORADIA.name, totalCents: 245000 },
                { typeId: EDUCACAO.id, name: EDUCACAO.name, totalCents: 120000 },
                { typeId: MERCADO.id, name: MERCADO.name, totalCents: 23490 },
                { typeId: LAZER.id, name: LAZER.name, totalCents: 10000 },
                { typeId: SAUDE.id, name: SAUDE.name, totalCents: 4570 },
            ],
        },
    ],
};

/** O que o dashboard mostra com estes dados. */
export const DASHBOARD_TEXT = {
    /** `500000 + (−12345)`; a conta arquivada fica de fora. */
    realized: 'R$ 4.876,55',
    forecast: 'R$ 6.123,45',
    /** `612345 − 487655`. */
    variation: '+R$ 1.246,90',
    /** As três receitas de outubro de `earnings.ts`. */
    earnings: '+R$ 7.300,50',
    earningsCounts: '1 recebida · 2 pendentes',
    /** As despesas de outubro, de todos os status (sem o IPVA, de setembro). */
    expenses: '−R$ 4.180,50',
    expensesCounts: '1 paga · 5 pendentes · 1 vencida',
    /** "Vence esta semana", em ordem de vencimento. */
    due: [
        'IPVA',
        'Fatura Itaú Visa',
        'Farmácia',
        'Fatura Nubank Roxinho',
        'Internet',
        'Condomínio',
    ],
    /** "Despesas por tipo": os três maiores e o resto em "Outros" (`10000 + 4570`). */
    byType: ['Moradia', 'Educação', 'Mercado', 'Outros'],
    others: 'R$ 145,70',
} as const;

export interface DashboardStubOptions {
    /** Responde `GET /statements` com este status de erro. */
    statementsStatus?: number;
}

/**
 * A API do dashboard, respondendo pela query como o backend: `GET /expenses` filtra por `status`
 * e pelo intervalo de `occurredOn`; `GET /statements` pelo cartão. Qualquer outra chamada sob
 * `/api` é `404`. Chame depois do `stubRuntime` e antes do `stubUsersMe`.
 */
export async function stubDashboard(
    page: Page,
    { statementsStatus }: DashboardStubOptions = {},
): Promise<RecordedRequest[]> {
    const requests: RecordedRequest[] = [];
    await page.route('**/api/**', (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(/^\/api(?=\/)/, '');
        const query = Object.fromEntries(url.searchParams);
        requests.push({ method: request.method(), path, query, body: null });
        const json = (data: unknown) => route.fulfill({ json: { data } });
        if (request.method() !== 'GET') return route.fulfill({ status: 404 });
        switch (path) {
            case '/bank-accounts':
                return json(BANK_ACCOUNTS);
            case '/credit-cards':
                return json(CREDIT_CARDS);
            case '/reports/balance':
                return json(BALANCE_OCTOBER);
            case '/reports/expenses-by-type':
                return json(EXPENSES_BY_TYPE_OCTOBER);
            case '/earnings':
                return json(OCTOBER_EARNINGS);
            case '/expenses':
                return json(
                    DASHBOARD_EXPENSES.filter(
                        (e) =>
                            (!query.status || e.status === query.status) &&
                            (!query.from || e.occurredOn >= query.from) &&
                            (!query.to || e.occurredOn <= query.to),
                    ),
                );
            case '/statements':
                if (statementsStatus) {
                    return route.fulfill({
                        status: statementsStatus,
                        json: { error: { code: 'INTERNAL_ERROR', message: 'boom' } },
                    });
                }
                return json(DASHBOARD_STATEMENTS[query.creditCardId ?? ''] ?? []);
            default:
                return route.fulfill({
                    status: 404,
                    json: { error: { code: 'ROUTE_NOT_FOUND', message: 'not stubbed' } },
                });
        }
    });
    return requests;
}
