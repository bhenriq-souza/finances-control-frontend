import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get } }));

import { useAccountLookup, useCardLookup } from './lookups';
import { queryKeys } from './keys';

const ACCOUNTS = [
    { id: 'conta-ativa', description: 'Conta corrente', archivedAt: null },
    { id: 'conta-arquivada', description: 'Poupança antiga', archivedAt: '2026-09-01T00:00:00Z' },
];
const CARDS = [
    { id: 'cartao-ativo', name: 'Nubank', archivedAt: null },
    { id: 'cartao-arquivado', name: 'Cartão antigo', archivedAt: '2026-09-01T00:00:00Z' },
];

function wrapperFor(client: QueryClient) {
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
}

beforeEach(() => {
    mocks.get.mockReset();
});

describe('reference lookups', () => {
    // AC-0009-10 / ERR-0009-06.
    it('useAccountLookup labels an archived account and a removed one', () => {
        const client = new QueryClient();
        client.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);

        const { result } = renderHook(() => useAccountLookup(), { wrapper: wrapperFor(client) });

        expect(result.current.isReady).toBe(true);
        expect(result.current.label('conta-ativa')).toBe('Conta corrente');
        expect(result.current.label('conta-arquivada')).toBe('Poupança antiga');
        expect(result.current.label('desconhecida')).toBe('Conta removida');
        expect([...result.current.labels.keys()]).toEqual(['conta-ativa', 'conta-arquivada']);
    });

    it('useCardLookup labels an archived card and a removed one', () => {
        const client = new QueryClient();
        client.setQueryData(queryKeys.creditCards.all, CARDS);

        const { result } = renderHook(() => useCardLookup(), { wrapper: wrapperFor(client) });

        expect(result.current.label('cartao-arquivado')).toBe('Cartão antigo');
        expect(result.current.label('desconhecido')).toBe('Cartão removido');
    });

    it('does not call an item removed before the reference query has data', async () => {
        let resolve: (value: unknown) => void = () => undefined;
        mocks.get.mockReturnValue(new Promise((done) => (resolve = done)));
        const client = new QueryClient();

        const { result } = renderHook(() => useAccountLookup(), { wrapper: wrapperFor(client) });

        expect(result.current.isReady).toBe(false);
        expect(result.current.label('conta-ativa')).toBe('');
        expect(mocks.get).toHaveBeenCalledWith('/bank-accounts', {
            params: { query: { archived: 'true' } },
        });

        resolve({ data: { data: ACCOUNTS }, response: new Response(null, { status: 200 }) });
        await waitFor(() => {
            expect(result.current.label('conta-ativa')).toBe('Conta corrente');
        });
    });
});
