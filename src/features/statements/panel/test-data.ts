import type { BankAccount } from '@/api/queries/reference';

import type { Statement, StatementExpense } from './statement-model';

// Dados dos testes unitários das faturas (spec 0013). "Hoje" é 2026-10-20.

export const CARD_ID = '22000000-0000-4000-8000-000000000001';
export const ACCOUNT_ID = '21000000-0000-4000-8000-000000000001';
export const CLOSED_ID = '40000000-0000-4000-8000-000000000009';
export const OLDER_ID = '40000000-0000-4000-8000-000000000008';
export const EXPENSE_ID = '60000000-0000-4000-8000-000000000001';

export const ACCOUNTS: BankAccount[] = [
    {
        id: ACCOUNT_ID,
        bank: {
            id: '20000000-0000-4000-8000-000000000001',
            febrabanCode: '341',
            name: 'Itaú',
            archivedAt: null,
            createdAt: '2026-01-10T12:00:00Z',
        },
        type: 'CHECKING',
        accountNumber: '12345-6',
        description: 'Conta corrente',
        openingBalanceCents: 0,
        currentBalanceCents: 0,
        overdraftLimitCents: 0,
        archivedAt: null,
        createdAt: '2026-01-10T12:00:00Z',
    },
];

export function expenseFixture(overrides: Partial<StatementExpense> = {}): StatementExpense {
    return {
        id: EXPENSE_ID,
        description: 'Notebook',
        occurredOn: '2026-10-10',
        postedOn: '2026-10-10',
        amountCents: 40000,
        status: 'OPEN',
        expenseType: { id: '30000000-0000-4000-8000-000000000001', name: 'Eletrônicos' },
        installment: { groupId: '50000000-0000-4000-8000-000000000001', number: 2, total: 3 },
        reconciledAt: null,
        ...overrides,
    };
}

export function statementFixture(overrides: Partial<Statement> = {}): Statement {
    return {
        id: null,
        creditCardId: CARD_ID,
        status: 'OPEN',
        startsOn: '2026-10-09',
        closesOn: '2026-11-08',
        dueOn: '2026-11-15',
        purchasesCents: 52345,
        refundsCents: 2000,
        totalCents: 50345,
        reconciledCents: 38000,
        pendingReconciliationCents: 12345,
        previousBalanceCents: 0,
        amountDueCents: 50345,
        paidCents: 10000,
        remainingCents: 40345,
        minimumPaymentCents: null,
        overdue: false,
        closedAt: null,
        byExpenseType: [
            {
                expenseTypeId: '30000000-0000-4000-8000-000000000001',
                name: 'Eletrônicos',
                totalCents: 40000,
            },
            {
                expenseTypeId: '30000000-0000-4000-8000-000000000002',
                name: 'Mercado',
                totalCents: 12345,
            },
        ],
        ...overrides,
    };
}

/** A fatura atual com o detalhe: uma despesa parcelada, um estorno e um pagamento antecipado. */
export const CURRENT: Statement = statementFixture({
    expenses: [expenseFixture()],
    refunds: [
        {
            id: '70000000-0000-4000-8000-000000000001',
            creditCardId: CARD_ID,
            expenseId: null,
            description: 'Estorno da loja',
            amountCents: 2000,
            occurredOn: '2026-10-12',
            postedOn: '2026-10-12',
            notes: null,
            createdAt: '2026-10-12T12:00:00Z',
            updatedAt: '2026-10-12T12:00:00Z',
        },
    ],
    payments: [
        {
            id: '80000000-0000-4000-8000-000000000001',
            bankAccountId: ACCOUNT_ID,
            amountCents: 10000,
            paidOn: '2026-10-15',
            createdAt: '2026-10-15T12:00:00Z',
        },
    ],
});

/** Fechada, vencida, com saldo anterior e mínimo informado. */
export const CLOSED: Statement = statementFixture({
    id: CLOSED_ID,
    status: 'CLOSED',
    startsOn: '2026-09-09',
    closesOn: '2026-10-08',
    dueOn: '2026-10-15',
    purchasesCents: 30000,
    refundsCents: 0,
    totalCents: 30000,
    previousBalanceCents: 5000,
    amountDueCents: 35000,
    paidCents: 0,
    remainingCents: 35000,
    minimumPaymentCents: 7000,
    overdue: true,
    closedAt: '2026-10-09T03:00:00Z',
});

export const OLDER: Statement = statementFixture({
    id: OLDER_ID,
    status: 'PAID',
    startsOn: '2026-08-09',
    closesOn: '2026-09-08',
    dueOn: '2026-09-15',
    amountDueCents: 12000,
    paidCents: 12000,
    remainingCents: 0,
    closedAt: '2026-09-09T03:00:00Z',
});

/** Projetadas (parcelas futuras), sem `id`. */
export const UPCOMING: Statement[] = [
    statementFixture({
        startsOn: '2026-12-09',
        closesOn: '2027-01-08',
        dueOn: '2027-01-15',
        totalCents: 40000,
    }),
    statementFixture({
        startsOn: '2026-11-09',
        closesOn: '2026-12-08',
        dueOn: '2026-12-15',
        totalCents: 40001,
    }),
];
