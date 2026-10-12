import { hashKey } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { ENTRY_STALE_TIME, normalizeParams, queryKeys, REFERENCE_STALE_TIME } from './keys';

describe('queryKeys', () => {
    it('builds the keys of the spec table', () => {
        expect(queryKeys.users.me()).toEqual(['users', 'me']);
        expect(queryKeys.users.list()).toEqual(['users', 'list']);
        expect(queryKeys.banks.all).toEqual(['banks']);
        expect(queryKeys.bankAccounts.all).toEqual(['bank-accounts']);
        expect(queryKeys.creditCards.all).toEqual(['credit-cards']);
        expect(queryKeys.expenseTypes.all).toEqual(['expense-types']);
        expect(queryKeys.earningTypes.all).toEqual(['earning-types']);
        expect(queryKeys.expenses.list({ from: '2026-10-01' })).toEqual([
            'expenses',
            'list',
            { from: '2026-10-01' },
        ]);
        expect(queryKeys.expenses.detail('e1')).toEqual(['expenses', 'detail', 'e1']);
        expect(queryKeys.earnings.list()).toEqual(['earnings', 'list', {}]);
        expect(queryKeys.earnings.detail('r1')).toEqual(['earnings', 'detail', 'r1']);
        expect(queryKeys.statements.list('c1', { from: '2026-01' })).toEqual([
            'statements',
            'list',
            'c1',
            { from: '2026-01' },
        ]);
        expect(queryKeys.statements.current('c1')).toEqual(['statements', 'current', 'c1']);
        expect(queryKeys.statements.detail('s1')).toEqual(['statements', 'detail', 's1']);
        expect(queryKeys.creditCardRefunds.detail('x')).toEqual([
            'credit-card-refunds',
            'detail',
            'x',
        ]);
        expect(queryKeys.bankTransfers.list({})).toEqual(['bank-transfers', 'list', {}]);
        expect(queryKeys.expenseRecurrences.all).toEqual(['expense-recurrences']);
        expect(queryKeys.earningRecurrences.detail('y')).toEqual([
            'earning-recurrences',
            'detail',
            'y',
        ]);
        expect(queryKeys.reports.report('cash-flow', { months: 6 })).toEqual([
            'reports',
            'cash-flow',
            { months: 6 },
        ]);
    });

    // AC-0009-01: mesma chave para os mesmos filtros em qualquer ordem de propriedades.
    it('gives the same key for the same filters in any property order, omitting absent ones', () => {
        const a = queryKeys.expenses.list({
            to: '2026-10-31',
            from: '2026-10-01',
            status: undefined,
        });
        const b = queryKeys.expenses.list({ from: '2026-10-01', to: '2026-10-31' });

        expect(a).toEqual(b);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        expect(hashKey(a)).toBe(hashKey(b));
        expect(Object.keys(a[2])).toEqual(['from', 'to']);
        expect(queryKeys.reports.report('balance', { b: 1, a: null })).toEqual(
            queryKeys.reports.report('balance', { a: null, b: 1 }),
        );
    });

    it('keeps null and false values, which are sent', () => {
        expect(normalizeParams({ archived: false, id: null, none: undefined })).toEqual({
            archived: false,
            id: null,
        });
        expect(normalizeParams()).toEqual({});
    });

    it('defines the stale times of the spec', () => {
        expect(REFERENCE_STALE_TIME).toBe(300_000);
        expect(ENTRY_STALE_TIME).toBe(30_000);
    });
});
