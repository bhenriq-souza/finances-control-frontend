import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get } }));

import {
    bankAccountsQuery,
    banksQuery,
    creditCardsQuery,
    earningTypesQuery,
    expenseTypesQuery,
    useBankAccounts,
    useBanks,
    useCreditCards,
    useEarningTypes,
    useExpenseTypes,
} from './reference';

const ok = (body: unknown) => ({ data: body, response: new Response(null, { status: 200 }) });

interface ReferenceCase {
    name: string;
    query: { queryKey: readonly unknown[]; staleTime?: unknown };
    fetch: (client: QueryClient) => Promise<unknown>;
    path: string;
    hook: () => { data?: unknown };
}

const QUERIES: ReferenceCase[] = [
    {
        name: 'banks',
        query: banksQuery,
        fetch: (client: QueryClient) => client.fetchQuery(banksQuery),
        path: '/banks',
        hook: useBanks,
    },
    {
        name: 'bank-accounts',
        query: bankAccountsQuery,
        fetch: (client: QueryClient) => client.fetchQuery(bankAccountsQuery),
        path: '/bank-accounts',
        hook: useBankAccounts,
    },
    {
        name: 'credit-cards',
        query: creditCardsQuery,
        fetch: (client: QueryClient) => client.fetchQuery(creditCardsQuery),
        path: '/credit-cards',
        hook: useCreditCards,
    },
    {
        name: 'expense-types',
        query: expenseTypesQuery,
        fetch: (client: QueryClient) => client.fetchQuery(expenseTypesQuery),
        path: '/expense-types',
        hook: useExpenseTypes,
    },
    {
        name: 'earning-types',
        query: earningTypesQuery,
        fetch: (client: QueryClient) => client.fetchQuery(earningTypesQuery),
        path: '/earning-types',
        hook: useEarningTypes,
    },
];

function wrapperFor(client: QueryClient) {
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
}

beforeEach(() => {
    mocks.get.mockReset();
});

describe('reference queries', () => {
    it.each(QUERIES)(
        '$name: one key, archived included, 5 minutes stale time',
        async ({ name, query, fetch, path }) => {
            mocks.get.mockResolvedValue(ok({ data: [{ id: 'a' }] }));

            expect(query.queryKey).toEqual([name]);
            expect(query.staleTime).toBe(300_000);
            await expect(fetch(new QueryClient())).resolves.toEqual([{ id: 'a' }]);
            expect(mocks.get).toHaveBeenCalledWith(path, {
                params: { query: { archived: 'true' } },
            });
        },
    );

    it('throws the catalog ApiError for a body without data', async () => {
        mocks.get.mockResolvedValue(ok({}));
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        await expect(client.fetchQuery(banksQuery)).rejects.toMatchObject({
            code: 'UNEXPECTED_RESPONSE',
        });
    });

    it.each(QUERIES)('$name hook reads the query', async ({ hook }) => {
        mocks.get.mockResolvedValue(ok({ data: [{ id: 'b' }] }));
        const client = new QueryClient();

        const { result } = renderHook(() => hook(), { wrapper: wrapperFor(client) });

        await waitFor(() => {
            expect(result.current.data).toEqual([{ id: 'b' }]);
        });
    });
});
