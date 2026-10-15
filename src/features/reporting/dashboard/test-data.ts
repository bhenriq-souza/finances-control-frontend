import type { BankAccount, CreditCard } from '@/api/queries/reference';

import type { BalanceReport, ByTypeReport, Earning, Expense, Statement } from './dashboard-data';

// Dados dos testes do dashboard, com "hoje" em 2026-10-15 (AC-0015-01).

export const TODAY = '2026-10-15';
const CREATED = '2026-01-10T12:00:00Z';
const BANK = { id: 'b1', febrabanCode: '341', name: 'Itaú', archivedAt: null, createdAt: CREATED };

export function account(fields: Partial<BankAccount> & Pick<BankAccount, 'id'>): BankAccount {
    return {
        bank: BANK,
        type: 'CHECKING',
        accountNumber: '1',
        description: 'Conta',
        openingBalanceCents: 0,
        currentBalanceCents: 0,
        overdraftLimitCents: 0,
        archivedAt: null,
        createdAt: CREATED,
        ...fields,
    };
}

export function card(fields: Partial<CreditCard> & Pick<CreditCard, 'id'>): CreditCard {
    return {
        bank: BANK,
        name: 'Cartão',
        creditLimitCents: 100000,
        availableLimitCents: 100000,
        closingDay: 25,
        dueDay: 5,
        currentCycle: { startsOn: '2026-09-26', closesOn: '2026-10-25', dueOn: '2026-11-05' },
        paymentBankAccountId: null,
        archivedAt: null,
        createdAt: CREATED,
        ...fields,
    };
}

const TYPE = { id: 't1', name: 'Moradia', archivedAt: null, createdAt: CREATED };

export function expense(fields: Partial<Expense> & Pick<Expense, 'id' | 'description'>): Expense {
    return {
        kind: 'VARIABLE',
        status: 'OPEN',
        amountCents: 10000,
        occurredOn: TODAY,
        paidOn: null,
        notes: null,
        expenseType: TYPE,
        bankAccountId: 'a1',
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

export function earning(fields: Partial<Earning> & Pick<Earning, 'id' | 'status'>): Earning {
    return {
        description: 'Receita',
        kind: 'VARIABLE',
        amountCents: 10000,
        occurredOn: TODAY,
        receivedOn: null,
        notes: null,
        earningType: TYPE,
        bankAccountId: 'a1',
        installment: null,
        recurrenceId: null,
        createdAt: CREATED,
        updatedAt: CREATED,
        ...fields,
    };
}

export function statement(
    fields: Partial<Statement> & Pick<Statement, 'id' | 'creditCardId' | 'status'>,
): Statement {
    return {
        startsOn: '2026-09-09',
        closesOn: '2026-10-08',
        dueOn: '2026-10-15',
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

export function balanceReport(points: BalanceReport['points']): BalanceReport {
    return { from: '2026-10', to: '2026-10', points };
}

export function balancePoint(
    fields: Partial<BalanceReport['points'][number]> &
        Pick<BalanceReport['points'][number], 'month' | 'kind' | 'accountsTotalCents'>,
): BalanceReport['points'][number] {
    return {
        accounts: [],
        cardDebtCents: null,
        unassignedCardDebtCents: null,
        cardDueCents: null,
        consolidatedCents: null,
        ...fields,
    };
}

export function byTypeReport(months: ByTypeReport['months']): ByTypeReport {
    return { from: '2026-10', to: '2026-10', includeForecast: false, months };
}
