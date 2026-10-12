import { describe, expect, it } from 'vitest';

import { expenseFixture } from './expense-test-data';
import {
    currentMonth,
    expenseSupportText,
    sortExpenses,
    summarizeExpenses,
    summaryCountsText,
} from './expense-model';

describe('expense model (spec 0012, list)', () => {
    // AC-0012-01: ordem por `occurredOn`, depois por descrição.
    it('sorts by occurredOn and then by description, without mutating the input', () => {
        const input = [
            expenseFixture({ id: 'c', description: 'Zebra', occurredOn: '2026-10-10' }),
            expenseFixture({ id: 'a', description: 'Água', occurredOn: '2026-10-10' }),
            expenseFixture({ id: 'b', description: 'Mercado', occurredOn: '2026-10-02' }),
        ];
        expect(sortExpenses(input).map(({ id }) => id)).toEqual(['b', 'a', 'c']);
        expect(input.map(({ id }) => id)).toEqual(['c', 'a', 'b']);
    });

    it('sums the amounts in cents and counts paid, pending and overdue', () => {
        const summary = summarizeExpenses([
            expenseFixture({ status: 'PAID', amountCents: 180000 }),
            expenseFixture({ status: 'OVERDUE', amountCents: 4570 }),
            expenseFixture({ status: 'OPEN', amountCents: 10 }),
            expenseFixture({ status: 'FORECAST', amountCents: 20 }),
            expenseFixture({ status: 'VERIFYING', amountCents: 30 }),
        ]);
        expect(summary).toEqual({ totalCents: 184630, paid: 1, pending: 3, overdue: 1 });
        expect(Number.isSafeInteger(summary.totalCents)).toBe(true);
        expect(summaryCountsText(summary)).toBe('1 paga · 3 pendentes · 1 vencida');
        expect(summaryCountsText({ totalCents: 0, paid: 0, pending: 1, overdue: 2 })).toBe(
            '0 pagas · 1 pendente · 2 vencidas',
        );
    });

    it('describes an installment and a series occurrence', () => {
        expect(
            expenseSupportText(
                expenseFixture({ installment: { groupId: 'g', number: 2, total: 3 } }),
            ),
        ).toBe('Parcela 2 de 3');
        expect(expenseSupportText(expenseFixture({ recurrenceId: 'r' }))).toBe('Fixa');
        expect(expenseSupportText(expenseFixture())).toBeNull();
    });

    it('takes the current month from the reference date', () => {
        expect(currentMonth('2026-10-12')).toBe('2026-10');
        expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
    });
});
