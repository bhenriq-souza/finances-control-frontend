import type { BankAccount, CreditCard } from '@/api/queries/reference';

import type { BalanceReport, Earning, Expense, Statement } from './cash-flow-model';

// Dados dos testes do fluxo de caixa (spec 0015): "hoje" é 15/10/2026.

export const TODAY = '2026-10-15T12:00:00-03:00';

const CREATED = '2026-10-01T12:00:00Z';
export const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
export const CARD_ID = '33333333-3333-4333-8333-333333333333';
export const ARCHIVED_CARD_ID = '33333333-3333-4333-8333-333333333334';

const BANK = { id: 'b1', febrabanCode: '341', name: 'Itaú', archivedAt: null, createdAt: CREATED };

export const ACCOUNT: BankAccount = {
    id: ACCOUNT_ID,
    bank: BANK,
    type: 'CHECKING',
    accountNumber: '1',
    description: 'Conta corrente',
    openingBalanceCents: 0,
    currentBalanceCents: 0,
    overdraftLimitCents: 0,
    archivedAt: null,
    createdAt: CREATED,
};

export function card(fields: Partial<CreditCard> = {}): CreditCard {
    return {
        id: CARD_ID,
        bank: BANK,
        name: 'Itaú Visa',
        creditLimitCents: 100000,
        availableLimitCents: 100000,
        closingDay: 25,
        dueDay: 5,
        currentCycle: { startsOn: '2026-09-26', closesOn: '2026-10-25', dueOn: '2026-11-05' },
        paymentBankAccountId: ACCOUNT_ID,
        archivedAt: null,
        createdAt: CREATED,
        ...fields,
    };
}

export function earning(
    fields: Pick<Earning, 'id' | 'description' | 'status' | 'amountCents' | 'occurredOn'> &
        Partial<Earning>,
): Earning {
    return {
        kind: 'VARIABLE',
        receivedOn: null,
        notes: null,
        earningType: { id: 't1', name: 'Salário', archivedAt: null, createdAt: CREATED },
        bankAccountId: ACCOUNT_ID,
        installment: null,
        recurrenceId: null,
        createdAt: CREATED,
        updatedAt: CREATED,
        ...fields,
    };
}

export function expense(
    fields: Pick<Expense, 'id' | 'description' | 'status' | 'amountCents' | 'occurredOn'> &
        Partial<Expense>,
): Expense {
    return {
        kind: 'VARIABLE',
        paidOn: null,
        notes: null,
        expenseType: { id: 't2', name: 'Moradia', archivedAt: null, createdAt: CREATED },
        bankAccountId: ACCOUNT_ID,
        creditCardId: null,
        postedOn: null,
        installment: null,
        recurrenceId: null,
        createdAt: CREATED,
        updatedAt: CREATED,
        ...fields,
    };
}

export function statement(
    fields: Pick<Statement, 'id' | 'status' | 'closesOn' | 'dueOn'> & Partial<Statement>,
): Statement {
    return {
        creditCardId: CARD_ID,
        startsOn: '2026-08-26',
        purchasesCents: 0,
        refundsCents: 0,
        totalCents: 0,
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

type Point = BalanceReport['points'][number];

export function point(
    month: string,
    kind: Point['kind'],
    accountsTotalCents: number,
    cardDueCents: number | null = null,
): Point {
    return {
        month,
        kind,
        accounts: [],
        accountsTotalCents,
        cardDebtCents: null,
        unassignedCardDebtCents: null,
        cardDueCents,
        consolidatedCents: null,
    };
}

export const SALARY = earning({
    id: 'e1',
    description: 'Salário',
    status: 'RECEIVED',
    amountCents: 500000,
    occurredOn: '2026-10-05',
});
export const FREELA = earning({
    id: 'e2',
    description: 'Freela',
    status: 'OPEN',
    amountCents: 80000,
    occurredOn: '2026-10-20',
});
export const LATE_EARNING = earning({
    id: 'e3',
    description: 'Reembolso',
    status: 'OVERDUE',
    amountCents: 10000,
    occurredOn: '2026-10-08',
});
export const RENT = expense({
    id: 'x1',
    description: 'Aluguel',
    status: 'PAID',
    amountCents: 180000,
    occurredOn: '2026-10-05',
});
export const INTERNET = expense({
    id: 'x2',
    description: 'Internet',
    status: 'OPEN',
    amountCents: 9990,
    occurredOn: '2026-10-15',
});
export const PHARMACY = expense({
    id: 'x3',
    description: 'Farmácia',
    status: 'OVERDUE',
    amountCents: 4570,
    occurredOn: '2026-10-08',
});
/** Despesa de cartão: nunca entra (INV-0015-07). */
export const CARD_EXPENSE = expense({
    id: 'x4',
    description: 'Mercado no cartão',
    status: 'OPEN',
    amountCents: 23490,
    occurredOn: '2026-10-16',
    bankAccountId: null,
    creditCardId: CARD_ID,
});
/** Vencida de setembro: fica no seu mês. */
export const SEPTEMBER_OVERDUE = expense({
    id: 'x5',
    description: 'IPVA',
    status: 'OVERDUE',
    amountCents: 98000,
    occurredOn: '2026-09-28',
});

export const CLOSED_TO_PAY = statement({
    id: 's1',
    status: 'CLOSED',
    closesOn: '2026-09-25',
    dueOn: '2026-10-05',
    amountDueCents: 102550,
    remainingCents: 102550,
});
export const PAID_SEPTEMBER = statement({
    id: 's0',
    status: 'PAID',
    closesOn: '2026-08-25',
    dueOn: '2026-09-05',
    amountDueCents: 50000,
});
export const PROJECTED = statement({
    id: null,
    status: 'OPEN',
    closesOn: '2026-10-25',
    dueOn: '2026-11-05',
    amountDueCents: 30000,
    remainingCents: 30000,
});
