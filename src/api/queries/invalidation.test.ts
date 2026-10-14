import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { INVALIDATION_MATRIX, invalidateAfter, type WriteDomain } from './invalidation';
import { queryKeys, type QueryRoot } from './keys';

/** A matriz da spec 0009, transcrita para o teste. */
const EXPECTED: Record<WriteDomain, QueryRoot[]> = {
    profile: ['users'],
    accounts: ['banks', 'bank-accounts', 'credit-cards', 'statements', 'reports'],
    'expense-types': ['expense-types', 'expenses', 'statements', 'reports'],
    'earning-types': ['earning-types', 'earnings', 'reports'],
    expense: [
        'expenses',
        'expense-recurrences',
        'bank-accounts',
        'credit-cards',
        'statements',
        'reports',
    ],
    earning: ['earnings', 'earning-recurrences', 'bank-accounts', 'reports'],
    statement: ['statements', 'expenses', 'bank-accounts', 'credit-cards', 'reports'],
    refund: ['credit-card-refunds', 'statements', 'credit-cards', 'reports'],
    transfer: ['bank-transfers', 'bank-accounts', 'reports'],
    'expense-recurrence': ['expense-recurrences', 'expenses', 'statements', 'reports'],
    'earning-recurrence': ['earning-recurrences', 'earnings', 'reports'],
};

/** Uma chave de cada forma de cada raiz. */
const SAMPLE_KEYS: readonly (readonly unknown[])[] = [
    queryKeys.users.me(),
    queryKeys.users.list(),
    queryKeys.banks.all,
    queryKeys.bankAccounts.all,
    queryKeys.creditCards.all,
    queryKeys.expenseTypes.all,
    queryKeys.earningTypes.all,
    queryKeys.expenses.list({ from: '2026-10-01' }),
    queryKeys.expenses.detail('e1'),
    queryKeys.earnings.list({ from: '2026-10-01' }),
    queryKeys.earnings.detail('r1'),
    queryKeys.statements.list('c1', { from: '2026-01' }),
    queryKeys.statements.current('c1'),
    queryKeys.statements.detail('s1'),
    queryKeys.creditCardRefunds.list({}),
    queryKeys.creditCardRefunds.detail('x1'),
    queryKeys.bankTransfers.list({}),
    queryKeys.bankTransfers.detail('t1'),
    queryKeys.expenseRecurrences.list({}),
    queryKeys.expenseRecurrences.detail('er1'),
    queryKeys.earningRecurrences.list({}),
    queryKeys.earningRecurrences.detail('rr1'),
    queryKeys.reports.report('balance', { month: '2026-10' }),
    queryKeys.reports.report('cash-flow', {}),
];

function seededClient(): QueryClient {
    const client = new QueryClient();
    for (const key of SAMPLE_KEYS) client.setQueryData(key, 'dado');
    return client;
}

describe('invalidateAfter', () => {
    it('declares exactly the matrix of the spec', () => {
        expect(INVALIDATION_MATRIX).toEqual(EXPECTED);
    });

    // AC-0009-01 / INV-0009-02: exatamente as raízes da linha, nenhuma outra.
    it.each(Object.entries(EXPECTED) as [WriteDomain, QueryRoot[]][])(
        'invalidates exactly the roots of %s',
        async (domain, roots) => {
            const client = seededClient();

            await invalidateAfter(client, domain);

            for (const key of SAMPLE_KEYS) {
                const invalidated = client.getQueryState(key)?.isInvalidated;
                expect({ key, invalidated }).toEqual({
                    key,
                    invalidated: roots.includes(key[0] as QueryRoot),
                });
            }
        },
    );
});
