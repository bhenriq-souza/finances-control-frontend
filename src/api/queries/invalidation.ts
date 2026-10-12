import type { QueryClient } from '@tanstack/react-query';

import type { QueryRoot } from './keys';

/** Domínio de uma escrita (spec 0009, "Invalidação depois de uma escrita"). */
export type WriteDomain =
    | 'profile'
    | 'accounts'
    | 'expense-types'
    | 'earning-types'
    | 'expense'
    | 'earning'
    | 'statement'
    | 'refund'
    | 'transfer'
    | 'expense-recurrence'
    | 'earning-recurrence';

/** Raízes invalidadas por domínio da escrita. */
export const INVALIDATION_MATRIX: Readonly<Record<WriteDomain, readonly QueryRoot[]>> = {
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

/**
 * Invalida as raízes do domínio que escreveu. Toda mutação de tela chama esta função no
 * `onSuccess`, nunca invalida chaves à mão (INV-0009-02).
 */
export async function invalidateAfter(
    queryClient: QueryClient,
    domain: WriteDomain,
): Promise<void> {
    await Promise.all(
        INVALIDATION_MATRIX[domain].map((root) =>
            queryClient.invalidateQueries({ queryKey: [root] }),
        ),
    );
}
