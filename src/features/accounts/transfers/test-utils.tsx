import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render } from '@testing-library/react';
import { useState, type ReactNode } from 'react';

import { CURRENT_USER_QUERY_KEY, type CurrentUser, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import type { BankAccount } from '@/api/queries/reference';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import type { BankTransfer } from './api';

// Só para testes: dados e montagem das telas de transferência.

export const CORRENTE = '11111111-1111-4111-8111-111111111111';
export const POUPANCA = '22222222-2222-4222-8222-222222222222';
export const ANTIGA = '33333333-3333-4333-8333-333333333333';

function account(id: string, description: string, archivedAt: string | null = null): BankAccount {
    return {
        id,
        bank: {
            id: '99999999-9999-4999-8999-999999999999',
            febrabanCode: '260',
            name: 'Nu Pagamentos',
            archivedAt: null,
            createdAt: '2026-01-01T00:00:00Z',
        },
        type: 'CHECKING',
        accountNumber: '12345-6',
        description,
        openingBalanceCents: 0,
        currentBalanceCents: 0,
        overdraftLimitCents: 0,
        archivedAt,
        createdAt: '2026-01-01T00:00:00Z',
    };
}

export const ACCOUNTS: BankAccount[] = [
    account(CORRENTE, 'Conta corrente'),
    account(POUPANCA, 'Poupança'),
    account(ANTIGA, 'Conta antiga', '2026-09-01T00:00:00Z'),
];

export function transfer(overrides: Partial<BankTransfer> = {}): BankTransfer {
    return {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        fromBankAccountId: CORRENTE,
        toBankAccountId: POUPANCA,
        amountCents: 50000,
        occurredOn: '2026-10-05',
        status: 'COMPLETED',
        completedOn: '2026-10-05',
        description: 'Reserva do mês',
        notes: null,
        createdAt: '2026-10-05T12:00:00Z',
        updatedAt: '2026-10-05T12:00:00Z',
        ...overrides,
    };
}

function user(profile: Profile): CurrentUser {
    return {
        id: 'id',
        email: 'ana@example.com',
        emailVerified: true,
        name: 'Ana Souza',
        profile,
        profileGrantedAt: null,
        avatarUpdatedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
    };
}

/** Resposta de sucesso do cliente gerado. */
export function ok(data: unknown, status = 200) {
    return { data: { data }, response: { ok: true, status } };
}

/**
 * `GET` simulado por caminho: as contas vêm de `ACCOUNTS` (a invalidação de uma escrita as
 * recarrega) e o resto de `responses`.
 */
export function getByPath(responses: Record<string, unknown>) {
    return (path: string) => (path === '/bank-accounts' ? ok(ACCOUNTS) : responses[path]);
}

/** Resposta `204` do cliente gerado. */
export function noContent() {
    return { data: undefined, response: { ok: true, status: 204 } };
}

/** Resposta de erro do cliente gerado, com o corpo `Error` do contrato. */
export function fail(status: number, code: string, details?: unknown) {
    return {
        error: { error: { code, message: 'raw message', details } },
        response: { ok: false, status },
    };
}

/**
 * Monta uma tela com o cache (usuário atual e contas), os avisos e um roteador em memória; os
 * parâmetros de busca ficam num estado local, como a rota faria.
 */
export async function renderWithSearch<S extends object>(
    initial: S,
    page: (search: S, onSearchChange: (next: Partial<S>) => void) => ReactNode,
    { profile = 'ADMIN' as Profile } = {},
) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user(profile));
    queryClient.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    const searches: S[] = [];

    function Harness() {
        const [search, setSearch] = useState(initial);
        return page(search, (next) =>
            setSearch((previous) => {
                const merged = { ...previous, ...next };
                searches.push(merged);
                return merged;
            }),
        );
    }

    const router = createRouter({
        routeTree: createRootRoute({ component: Harness }),
        history: createMemoryHistory(),
    });
    await router.load();
    await act(async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <NoticeProvider store={createNoticeStore()}>
                    <RouterProvider router={router} />
                </NoticeProvider>
            </QueryClientProvider>,
        );
    });
    return { queryClient, searches };
}
